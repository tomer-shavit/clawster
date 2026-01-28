# Production Environment Configuration
aws_region = "us-east-1"
environment = "production"
domain_name = "molthub.ai"

api_desired_count = 3
web_desired_count = 3

db_instance_class = "db.t3.small"
db_allocated_storage = 100

enable_deletion_protection = true
