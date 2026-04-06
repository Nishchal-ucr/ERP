import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from '../auth/jwt.strategy';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { phone, password } = loginDto;

    // Find user by phone
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    // Return user data (exclude passwordHash)
    const { passwordHash, ...userData } = user;
    return {
      message: 'Login successful',
      user: {
        ...userData,
        id: userData.id.toString(), // Convert number to string for JSON serialization
      },
      token,
    };
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
    });
  }

  // Helper method to create a user (for seeding/testing)
  async createUser(userData: Partial<User>): Promise<User> {
    // Hash password if provided
    if (userData.passwordHash) {
      userData.passwordHash = await this.hashPassword(userData.passwordHash);
    }
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  // Helper method to hash password during user creation
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
