terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.34.0"
    }
  }
  backend "azurerm" {
    resource_group_name  = "eb-barebaro"

    storage_account_name = "barebarostate123"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
    subscription_id = "0e505815-503a-42ad-9e76-7b36755fbd81"
    tenant_id = "b7cded65-4f72-4ee3-b7de-0806e47607a4"
    client_id = "a9ef53c5-9684-4987-9cb4-9b49f1fa6962"
    use_oidc = true
  }
}
provider "azurerm" {
  features {}
  subscription_id = "0e505815-503a-42ad-9e76-7b36755fbd81"
}
data "azurerm_storage_account" "existing" {
  name                = "barebarolyd123"
  resource_group_name = "eb-barebaro"
}

resource "azurerm_resource_group" "baroweb" {
  name     = "eb-barebaro-web"
  location = "norwayeast" # corrected casing
}

resource "azurerm_service_plan" "function" {
  name                = "baro-fn-plan"
  location            = azurerm_resource_group.baroweb.location
  resource_group_name = azurerm_resource_group.baroweb.name
  os_type             = "Linux"
  sku_name            = "Y1"
}


resource "azurerm_static_web_app" "frontend" {
  name                = "baro-frontend"
  resource_group_name = azurerm_resource_group.baroweb.name
  location            = "West Europe"
  sku_tier            = "Free"
}

# Dedicated standard storage account for audio blobs (avoid Premium restrictions)
resource "azurerm_storage_account" "audio" {
  name                     = "barebarolyaudio" # must be globally unique; adjust if taken
  resource_group_name      = azurerm_resource_group.baroweb.name
  location                 = azurerm_resource_group.baroweb.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"
}

# Standard storage account for Function App (must support Azure Files)
resource "azurerm_storage_account" "fn" {
  name                     = "barebarofnstore" # adjust if taken
  resource_group_name      = azurerm_resource_group.baroweb.name
  location                 = azurerm_resource_group.baroweb.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "audio" {
  name                  = "audio"
  storage_account_id    = azurerm_storage_account.audio.id
  container_access_type = "blob" # Start public read; tighten later
}

# Cosmos DB account for sound metadata (serverless, free tier)
resource "azurerm_cosmosdb_account" "audio" {
  name                = "barebaro-cosmos"
  location            = azurerm_resource_group.baroweb.location
  resource_group_name = azurerm_resource_group.baroweb.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  free_tier_enabled   = true

  consistency_policy {
    consistency_level = "Session"
  }

  capabilities {
    name = "EnableServerless"
  }

  geo_location {
    location          = azurerm_resource_group.baroweb.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "audio" {
  name                = "audio"
  resource_group_name = azurerm_resource_group.baroweb.name
  account_name        = azurerm_cosmosdb_account.audio.name
}

resource "azurerm_cosmosdb_sql_container" "sounds" {
  name                  = "sounds"
  resource_group_name   = azurerm_resource_group.baroweb.name
  account_name          = azurerm_cosmosdb_account.audio.name
  database_name         = azurerm_cosmosdb_sql_database.audio.name
  partition_key_paths   = ["/userId"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"
    included_path { path = "/*" }
    excluded_path { path = "/waveform/*" }
  }
}

# Linux Function App for audio API (metadata management & SAS issuance)
resource "azurerm_linux_function_app" "api" {
  name                = "baro-audio-api"
  resource_group_name = azurerm_resource_group.baroweb.name
  location            = azurerm_resource_group.baroweb.location
  service_plan_id     = azurerm_service_plan.function.id
  storage_account_name       = azurerm_storage_account.fn.name
  storage_account_access_key = azurerm_storage_account.fn.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "18"
    }
  }

  app_settings = {
    AzureWebJobsStorage     = azurerm_storage_account.fn.primary_connection_string
    FUNCTIONS_WORKER_RUNTIME = "node"
    AUDIO_CONTAINER          = azurerm_storage_container.audio.name
    COSMOS_ENDPOINT          = azurerm_cosmosdb_account.audio.endpoint
    COSMOS_DATABASE          = azurerm_cosmosdb_sql_database.audio.name
    COSMOS_CONTAINER         = azurerm_cosmosdb_sql_container.sounds.name
    # For initial simplicity we inject key; later switch to managed identity & RBAC
    COSMOS_KEY               = azurerm_cosmosdb_account.audio.primary_key
  }
}

# Role assignments to enable managed identity future usage (keep even if key used initially)
resource "azurerm_role_assignment" "api_blob_data_fn" {
  scope                = azurerm_storage_account.fn.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_blob_data_audio" {
  scope                = azurerm_storage_account.audio.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.api.identity[0].principal_id
}

// NOTE: Data plane RBAC role assignment for Cosmos DB removed temporarily.
// The role name "Cosmos DB Built-in Data Contributor" is not discoverable via
// the current provider listing. Once ready to switch from key-based auth to
// managed identity, list available roles and add by role_definition_id.
// Example to discover GUID:
// az role definition list --name "Cosmos DB*" --query '[].{Name:roleName,Id:id}' -o table
// Then add a resource azurerm_role_assignment with role_definition_id pointing
// to the Data Contributor GUID.
