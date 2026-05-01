import { ApiProperty } from '@nestjs/swagger'

export class LoginResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  accessToken: string

  @ApiProperty({ example: '1|abc123randomstring' })
  refreshToken: string
}
