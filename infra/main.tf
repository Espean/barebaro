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