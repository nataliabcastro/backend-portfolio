import { ApiProperty } from '@nestjs/swagger'

export class RefreshResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  accessToken: string

  @ApiProperty({ example: '2|abc123randomstring' })
  refreshToken: string
}
