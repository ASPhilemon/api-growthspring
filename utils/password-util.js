import generator from 'generate-password';
import bcrypt from 'bcryptjs';
import zxcvbn from "zxcvbn"
import * as Errors from "./error-util.js"

export function hashPassword(plainPassword){
  const salt = bcrypt.genSaltSync()
  return bcrypt.hashSync(plainPassword, salt)
}

export function generatePassword(){
  const password = generator.generate({
    length: 10,
    numbers: true,
    symbols: true,
    uppercase: true,
    lowercase: true,
    strict: true
  });

  return password
}

export function validatePasswordStrength(password){
  const result = zxcvbn(password)
  if (result.score < 3){
    throw new Errors.BadRequestError("The password is too weak")
  }
}

export async function matchPasswordWithHash(password, hash){
  const match = await bcrypt.compare(password, hash )
  if (!match) throw new Errors.BadRequestError("Incorrect email or password")
}