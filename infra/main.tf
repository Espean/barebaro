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
  location = "Norway east"
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