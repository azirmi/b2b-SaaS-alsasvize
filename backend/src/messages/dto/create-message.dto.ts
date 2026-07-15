import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID('4')
  receiverId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  content: string;
}
