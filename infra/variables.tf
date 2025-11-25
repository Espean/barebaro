variable "admin_object_ids" {
	description = "List of Entra ID object IDs (or literals) allowed to administer sounds."
	type        = list(string)
	default     = [
		"3d4c4a730c1944748ee4c7fcea105330",
	]
}
