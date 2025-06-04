import generator from 'generate-password';
import bcrypt from 'bcryptjs';

export function generateHashedPassword(){
  const plainPassword = generateHashedPassword()
  const salt = bcrypt.genSaltSync()
  return bcrypt.hashSync(plainPassword, salt)
}

export function generatePassword(){
  const password = generator.generate({
    length: 8,
    numbers: true,
    symbols: true,
    uppercase: true,
    lowercase: true,
    strict: true
  });

  return password
}
