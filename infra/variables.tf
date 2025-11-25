variable "admin_object_ids" {
	description = "List of Entra ID object IDs (or literals) allowed to administer sounds."
	type        = list(string)
	default     = [
		"b62b638f-5192-45c0-be88-3d25d196349c",
	]
}
