variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production"
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "molthub"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "molthub.ai"
}

variable "api_container_port" {
  description = "Port exposed by the API container"
  type        = number
  default     = 3000
}

variable "web_container_port" {
  description = "Port exposed by the Web container"
  type        = number
  default     = 3000
}

variable "api_desired_count" {
  description = "Desired number of API containers"
  type        = number
  default     = 2
}

variable "web_desired_count" {
  description = "Desired number of Web containers"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for resources"
  type        = bool
  default     = false
}
