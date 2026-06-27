# Safe Delete Candidates
Generated: 2026-06-26 23:16:55 UTC
Method: conservative tracked-file scan
Scanned pool size: 189
Candidates: 53

Exclusions applied: node_modules, dist, bin, obj, .terraform, terraform state files
Candidate rule: no references found by relative path OR basename in other tracked files

Review each candidate before deletion (runtime discovery and manual usage may not be text-referenced).

.github/dependabot.yml
.github/workflows/workflows/codeql.yml
IMPROVEMENTS_GUIDE.md
backend/Controllers/MessagesController.cs
backend/Controllers/UsersController.cs
backend/Dockerfile
backend/Entities/ComparisonItemEntity.cs
backend/Entities/GeneratedReplyEntity.cs
backend/Entities/MessageAnalysisEntity.cs
backend/Entities/MessageEntity.cs
backend/Entities/OfferComparisonEntity.cs
backend/Entities/OpportunityEntity.cs
backend/Entities/UserEntity.cs
backend/Extensions/ClaimsPrincipalExtensions.cs
backend/Models/AuthLoginRequest.cs
backend/Models/AuthRegisterRequest.cs
backend/Models/AuthResponse.cs
backend/Models/AuthUserDto.cs
backend/Properties/launchSettings.json
backend/Repositories/EfRepository.cs
backend/Repositories/IMessageRepository.cs
backend/Repositories/IOpportunityRepository.cs
backend/Repositories/IRepository.cs
backend/Repositories/IUserRepository.cs
backend/Repositories/OpportunityRepository.cs
backend/Services/DefaultUserService.cs
backend/Services/IDefaultUserService.cs
backend/Services/IJwtTokenService.cs
backend/Services/IPasswordHashService.cs
backend/Services/JwtTokenService.cs
backend/Services/PasswordHashService.cs
backend/sql/bootstrap_local_postgres.sh
deploy-test.txt
docs/AWS_DEV_DEPLOY.md
docs/ERROR_001_Action.md
docs/ROADMAP.md
frontend/Dockerfile
frontend/postcss.config.js
frontend/src/hooks/useReply.ts
frontend/src/hooks/useToast.ts
frontend/src/hooks/useUI.ts
frontend/src/vite-env.d.ts
infra/aws/rout53/route53.tf
infra/aws/terraform/locals.tf
infra/aws/terraform/providers.tf
infra/aws/terraform/terraform.tfvars.example
infra/aws/terraform/versions.tf
infra/k8s/dev/kustomization.yaml
infra/k8s/dev/secret.example.yaml
scripts/aws/bootstrap_dev.sh
scripts/aws/create_github_oidc_role.sh
scripts/aws/deploy_dev_local.sh
start-frontend.sh
