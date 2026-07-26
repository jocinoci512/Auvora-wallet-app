# Auvora Wallet — Terraform

Cloud-agnostic infrastructure with an AWS VPC stub in `main.tf` and optional modules under `modules/`.

## Layout

```
terraform/
  main.tf          # Existing AWS VPC stub (preserved)
  modules.tf       # Optional module wiring (enabled=false by default)
  modules/         # networking, postgres, redis, storage, secrets, iam,
                   # monitoring, kubernetes, dns, loadbalancer
  envs/            # Per-environment tfvars examples
```

## Quick start

```bash
cd infrastructure/terraform
terraform init
terraform validate
```

No live cloud credentials are required for `terraform validate`. Optional modules use `null_resource` placeholders until AWS/Azure/GCP providers are wired in.

## Environment configuration

Copy an example tfvars file for your target environment:

```bash
cp envs/development/terraform.tfvars.example envs/development/terraform.tfvars
terraform plan -var-file=envs/development/terraform.tfvars
```

For local state, see `envs/local/backend.tfvars.example`.

## Windows notes

Run validation via Git Bash, WSL, or the helper script:

```powershell
bash infrastructure/scripts/terraform-validate.sh
```

## Enabling modules

Set `modules.<name>.enabled = true` in your environment tfvars. Each module documents the cloud provider resources to add in its `main.tf` comments.

## Existing VPC resources

The root `main.tf` retains the original `aws_vpc`, subnets, and internet gateway. The `networking` module is a separate cloud-agnostic interface for future migration or multi-cloud use.
