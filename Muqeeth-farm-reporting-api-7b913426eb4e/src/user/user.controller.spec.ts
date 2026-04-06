import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

describe('UserController', () => {
  let controller: UserController;
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
      controllers: [UserController],
      providers: [UserService],
    }).compile();

    controller = module.get<UserController>(UserController);
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
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call userService.login and return result', async () => {
      const loginDto = { phone: '1234567890', password: 'testpassword' };
      const expectedResult = {
        message: 'Login successful',
        user: {
          id: expect.any(String), // id will be auto-generated and converted to string
          name: 'John Doe',
          phone: '1234567890',
          role: 'OWNER' as const,
          createdAt: expect.any(Date),
        },
        token: expect.any(String),
      };

      jest.spyOn(service, 'login').mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });
});
