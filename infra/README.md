# Public demo on AWS

One EC2 instance in `eu-central-1` runs the same compose stack as locally, with Caddy in front
for HTTPS (Let's Encrypt). About 20 USD a month; a budget alert mails above 80 % of 25 USD.

| Piece | Where |
|---|---|
| Server, security group (80/443 only, no SSH), elastic IP | [`server.tf`](server.tf) |
| First boot: Docker, secrets generated on the server, nightly reset | [`user-data.sh.tftpl`](user-data.sh.tftpl) |
| Server role (Systems Manager), GitHub OIDC deploy role | [`iam.tf`](iam.tf) |
| Caddy, deploy and reset scripts | [`../deploy/`](../deploy) |
| Deploy on every release, then a smoke test over HTTPS | [`../.github/workflows/deploy-demo.yml`](../.github/workflows/deploy-demo.yml) |

## Set up (once)

1. **State bucket** for Terraform, with an AWS profile allowed to create it:

   ```bash
   aws s3api create-bucket --bucket djebabtoufik-sample-project-tfstate --region eu-central-1 \
     --create-bucket-configuration LocationConstraint=eu-central-1
   aws s3api put-bucket-versioning --bucket djebabtoufik-sample-project-tfstate \
     --versioning-configuration Status=Enabled
   aws s3api put-public-access-block --bucket djebabtoufik-sample-project-tfstate \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```

2. **Create the infrastructure:** `terraform init`, `terraform plan`, `terraform apply`.
3. **DNS:** create the record from the `dns_record` output (`demo` A record to the elastic IP).
4. **GitHub:** repository variables `AWS_DEPLOY_ROLE_ARN` and `DEMO_INSTANCE_ID` from the outputs.
5. **First deploy:** Actions, *Deploy demo*, *Run workflow* with the latest release. Later
   releases deploy themselves.

## Operate

- **Logs or a shell on the server:** Systems Manager, *Session Manager* (no SSH key needed), then
  `cd /opt/oee && docker compose logs`.
- **Reset now:** `systemctl start oee-reset.service` (runs every night at 03:00 Berlin time).
- **Remove everything:** `terraform destroy`, then delete the DNS record.
