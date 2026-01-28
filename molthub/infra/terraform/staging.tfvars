# Staging Environment Configuration
aws_region = "us-east-1"
environment = "staging"
domain_name = "staging.molthub.ai"

api_desired_count = 2
web_desired_count = 2

db_instance_class = "db.t3.micro"
db_allocated_storage = 20

enable_deletion_protection = false
