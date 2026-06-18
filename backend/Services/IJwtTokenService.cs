using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public interface IJwtTokenService
{
    string GenerateToken(UserEntity user);
}
