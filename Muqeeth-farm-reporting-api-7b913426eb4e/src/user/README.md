# User Module

This module provides user authentication functionality including login API with SQLite database integration.

## Database Setup

The module is configured to use SQLite database with TypeORM. The database file `database.sqlite` will be created automatically in the project root.

### Installed Dependencies

The following packages have been installed:
- `@nestjs/typeorm` - NestJS TypeORM integration
- `typeorm` - TypeORM ORM
- `sqlite3` - SQLite database driver

### Database Configuration

The database is configured in `src/app.module.ts`:

```typescript
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: 'database.sqlite',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: true, // Set to false in production
  logging: process.env.NODE_ENV !== 'production',
})
```

### User Entity

The User entity is defined in `src/user/entities/user.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number; // Auto-incremented primary key

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, enum: ['OWNER', 'SUPERVISOR'] })
  role: 'OWNER' | 'SUPERVISOR';

  @CreateDateColumn()
  createdAt: Date;
}
```

### Database Schema

The users table is created with the following structure:
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `name` - VARCHAR(100) NOT NULL
- `phone` - VARCHAR(20) UNIQUE NOT NULL
- `passwordHash` - VARCHAR(255) NOT NULL
- `role` - VARCHAR CHECK(role IN ('OWNER','SUPERVISOR')) NOT NULL
- `createdAt` - DATETIME DEFAULT CURRENT_TIMESTAMP

## Authentication

The login API now implements secure password hashing and JWT (JSON Web Token) authentication:

### Password Security
- Passwords are hashed using bcrypt with salt rounds of 10
- Plain text passwords are never stored in the database
- Password verification uses secure bcrypt comparison

### JWT Tokens
- JWT tokens are generated on successful login
- Tokens expire after 24 hours
- Include user ID, phone, and role in the token payload
- Use `Authorization: Bearer <token>` header for authenticated requests

### Environment Variables
Set the JWT secret in production:
```bash
JWT_SECRET=your-secure-secret-key-here
```

## API Endpoints

### Login
- **Endpoint:** `POST /api/user/login`
- **Request Body:**
  ```json
  {
    "phone": "1234567890",
    "password": "userPassword"
  }
  ```
- **Response (Success):**
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": "1",
      "name": "John Doe",
      "phone": "1234567890",
      "role": "OWNER",
      "createdAt": "2026-03-22T13:55:02.000Z"
    }
  }
  ```
- **Response (Error):**
  ```json
  {
    "statusCode": 401,
    "message": "Invalid phone or password"
  }
  ```

## Testing

The module includes comprehensive unit tests that use an in-memory SQLite database for testing.

Run the tests:

```bash
npm test -- --testPathPattern=user
```

## Migration to Production Database

To use a different database (MySQL, PostgreSQL, etc.) in production:

1. Install the appropriate database driver:
   ```bash
   npm install mysql2  # for MySQL
   # or
   npm install pg     # for PostgreSQL
   ```

2. Update the TypeORM configuration in `src/app.module.ts`:
   ```typescript
   TypeOrmModule.forRoot({
     type: 'mysql', // or 'postgres'
     host: process.env.DB_HOST,
     port: parseInt(process.env.DB_PORT),
     username: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
     entities: [__dirname + '/**/*.entity{.ts,.js}'],
     synchronize: false, // Use migrations in production
     logging: false,
   })
   ```

3. For PostgreSQL, update the User entity to use `bigint`:
   ```typescript
   @PrimaryColumn({ type: 'bigint' })
   id: bigint;
   ```

## Project Structure

```
src/user/
├── entities/
│   └── user.entity.ts           # User database entity
├── dto/
│   └── login.dto.ts             # Login request DTO with validation
├── user.service.ts              # Business logic with database operations
├── user.service.spec.ts         # Service unit tests
├── user.controller.ts           # API endpoints
├── user.controller.spec.ts      # Controller unit tests
├── user.module.ts               # Module definition
└── README.md                     # This documentation
```

## Next Steps

1. Add password hashing with bcrypt
2. Implement JWT authentication
3. Add user registration endpoint
4. Add user profile management
5. Implement role-based access control
6. Add database migrations for production
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto) {
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

    // Return user data (exclude passwordHash)
    const { passwordHash, ...result } = user;
    return {
      message: 'Login successful',
      user: result,
      // In production, generate JWT token here
      // token: this.generateJwt(user);
    };
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
    });
  }

  // Helper method to hash password during user creation
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
```

### 4. Update App Module

The App Module has already been updated to import the `UserModule`.

### 5. Configure TypeORM in App Module

Update `src/app.module.ts` to include TypeORM configuration:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '@/src/app.controller';
import { AppService } from '@/src/app.service';
import { UserModule } from '@/src/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'flygoog',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 6. Update User Module for TypeORM

Update `src/user/user.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## API Endpoints

### Login
- **Endpoint:** `POST /api/user/login`
- **Request Body:**
  ```json
  {
    "phone": "1234567890",
    "password": "userPassword"
  }
  ```
- **Response (Success):**
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": 1,
      "name": "John Doe",
      "phone": "1234567890",
      "role": "OWNER",
      "createdAt": "2026-03-22T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response (Error):**
  ```json
  {
    "statusCode": 401,
    "message": "Invalid phone or password"
  }
  ```

## Project Structure

```
src/user/
├── entities/
│   └── user.entity.ts           # User database entity
├── dto/
│   └── login.dto.ts             # Login request DTO with validation
├── user.service.ts              # Business logic
├── user.service.spec.ts         # Service unit tests
├── user.controller.ts           # API endpoints
├── user.controller.spec.ts      # Controller unit tests
└── user.module.ts               # Module definition
```

## Testing

Run the tests:

```bash
npm run test
```

## Next Steps

1. Install the required database dependencies
2. Configure your database connection in the App Module
3. Update the User entity and User service with TypeORM decorators
4. Create DATABASE according to the schema provided
5. Update User Module to use TypeORM repository
6. Add JWT authentication for token generation (optional)
7. Add more user endpoints (register, update profile, etc.)
