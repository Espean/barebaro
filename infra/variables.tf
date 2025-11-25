variable "admin_object_ids" {
	description = "List of Entra ID object IDs (or literals) allowed to administer sounds."
	type        = list(string)
	default     = ["demo-user"]
}
