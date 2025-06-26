terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.34.0"
    }
  }
  backend "azurerm" {
    resource_group_name  = "eb-barebaro"
    storage_account_name = "barebarosa"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
    subscription_id = "f275d5ca-5939-420f-bba2-e502b7489668"
    tenant_id = "8b87af7d-8647-4dc7-8df4-5f69a2011bb5"
    client_id = "fc516b06-7c5c-474a-9379-949fa0b54e51"
    use_oidc = true
  }
}

provider "azurerm" {
  features {}
  subscription_id = "f275d5ca-5939-420f-bba2-e502b7489668"
}
data "azurerm_storage_account" "existing" {
  name                = "barebarosa"
  resource_group_name = "eb-barebaro"
}
resource "azurerm_storage_table" "metadata" {
  name                 = "audiometadata"
  storage_account_name = data.azurerm_storage_account.existing.name
}

resource "azurerm_resource_group" "baroweb" {
  name     = "eb-barebaro-web"
  location = "Norway east"
}

resource "azurerm_service_plan" "function" {
  name                = "baro-fn-plan"
  location            = azurerm_resource_group.baroweb.location
  resource_group_name = azurerm_resource_group.baroweb.name
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "api" {
  name                       = "baro-api"
  location                   = azurerm_resource_group.baroweb.location
  resource_group_name        = azurerm_resource_group.baroweb.name
  service_plan_id            = azurerm_service_plan.function.id
  storage_account_name       = data.azurerm_storage_account.existing.name
  storage_account_access_key = data.azurerm_storage_account.existing.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "18"
    }
  }

  app_settings = {
    "AzureWebJobsStorage"     = data.azurerm_storage_account.existing.primary_connection_string
    "FUNCTIONS_WORKER_RUNTIME" = "node"
    "METADATA_TABLE_NAME"     = azurerm_storage_table.metadata.name
  }
}

resource "azurerm_static_web_app" "frontend" {
  name                = "baro-frontend"
  resource_group_name = azurerm_resource_group.baroweb.name
  location            = "West Europe"
  sku_tier            = "Free"
}


resource "azurerm_static_web_app_custom_domain" "www_barebaro_no" {
  static_web_app_id = azurerm_static_web_app.frontend.id
  domain_name       = "www.barebaro.no"
  validation_type   = "cname-delegation"
}

