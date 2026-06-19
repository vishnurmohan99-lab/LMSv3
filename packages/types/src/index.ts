export type Role = "student" | "faculty" | "admin";

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}
