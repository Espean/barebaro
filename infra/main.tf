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
}

resource "azurerm_resource_group" "baroweb" {
  name     = "eb-barebaro-web"
  location = "Norway Est"
}