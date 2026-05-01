import { ApiProperty } from '@nestjs/swagger'

export class RefreshDto {
  @ApiProperty({ example: '1|abc123randomstring' })
  refreshToken: string
}
