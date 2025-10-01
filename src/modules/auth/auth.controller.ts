import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { CreateMerchantDto, LoginMerchantDto, AuthResponseDto } from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ 
    summary: 'Register a new merchant',
    description: 'Create a new merchant account with business details and credentials'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Merchant registered successfully',
    type: AuthResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or merchant already exists' })
  async register(@Body() createMerchantDto: CreateMerchantDto) {
    const result = await this.authService.register(createMerchantDto);
    return {
      success: true,
      data: result,
      message: 'Merchant registered successfully',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Login merchant',
    description: 'Authenticate merchant and receive access token'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: AuthResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginMerchantDto) {
    const result = await this.authService.login(loginDto);
    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }
}