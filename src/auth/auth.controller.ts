import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger'
import { User as IUser } from '@prisma/client'

import { Validate } from '@shared/decorators/validate.decorator'
import { Auth } from '@shared/decorators/auth.decorator'
import { User } from '@shared/decorators/user.decorator'

import { AuthService } from './auth.service'

import { LoginDto } from './dto/login.dto'
import { LoginSchema } from './schemas/login.schema'
import { LoginResponse } from './interfaces/login-response.interface'

import { RegisterDto } from './dto/register.dto'
import { RegisterSchema } from './schemas/register.schema'
import { RegisterResponse } from './interfaces/register-response.interface'

import { RefreshDto } from './dto/refresh.dto'
import { RefreshResponse } from './interfaces/refresh-response.interface'

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Validate(LoginSchema)
  @ApiOperation({ summary: 'Authenticates a user and returns access tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: LoginResponse })
  @ApiResponse({ status: 404, description: 'Invalid email or password' })
  async login(@Body() data: LoginDto): Promise<LoginResponse> {
    const user = await this.authService.validateLogin(data)

    const { accessToken, refreshToken } = await this.authService.login(user)

    return { accessToken, refreshToken }
  }

  @Post('register')
  @HttpCode(201)
  @Validate(RegisterSchema)
  @ApiOperation({ summary: 'Registers a new user and returns access tokens' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, type: RegisterResponse })
  @ApiResponse({ status: 422, description: 'Email already registered' })
  async register(@Body() data: RegisterDto): Promise<RegisterResponse> {
    await this.authService.validateRegister(data)

    const user = await this.authService.register(data)

    const { accessToken, refreshToken } = await this.authService.login(user)

    return { accessToken, refreshToken }
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renews tokens from a valid refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, type: RefreshResponse })
  @ApiResponse({ status: 404, description: 'Invalid refresh token' })
  async refresh(@Body() data: RefreshDto): Promise<RefreshResponse> {
    const user = await this.authService.validateRefresh(data.refreshToken)

    const { accessToken, refreshToken } = await this.authService.login(user)

    return { accessToken, refreshToken }
  }

  @Get('me')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Returns information of the currently logged-in user' })
  @ApiResponse({ status: 200, description: 'Authenticated user data' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async me(@User() user: IUser): Promise<IUser> {
    return user
  }
}
