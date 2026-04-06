import { ApiProperty } from '@nestjs/swagger';

class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '1',
  })
  id: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
  })
  phone: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
  })
  role: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Login success message',
    example: 'Login successful',
  })
  message: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;
}
