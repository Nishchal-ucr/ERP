import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([User]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '24h' },
        }),
      ],
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);

    // Seed test user with plain password (will be hashed by createUser)
    await service.createUser({
      name: 'John Doe',
      phone: '1234567890',
      passwordHash: 'testpassword', // This will be hashed
      role: 'OWNER',
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return user data on successful login', async () => {
      const loginDto = { phone: '1234567890', password: 'testpassword' };
      const result = await service.login(loginDto);

      expect(result.message).toBe('Login successful');
      expect(result.user.phone).toBe('1234567890');
      expect(result.user.id).toBeDefined(); // id should be defined (auto-generated)
      expect(result.user).not.toHaveProperty('passwordHash'); // passwordHash should be excluded
      expect(result.token).toBeDefined(); // JWT token should be present
      expect(typeof result.token).toBe('string');
    });

    it('should throw UnauthorizedException for invalid phone', async () => {
      const loginDto = { phone: '9999999999', password: 'password' };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto = { phone: '1234567890', password: 'wrong_password' };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('findByPhone', () => {
    it('should return user if found', async () => {
      const user = await service.findByPhone('1234567890');

      expect(user).toBeDefined();
      expect(user.phone).toBe('1234567890');
    });

    it('should return null if user not found', async () => {
      const user = await service.findByPhone('9999999999');

      expect(user).toBeNull();
    });
  });
});
