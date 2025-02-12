const bcrypt = require('bcrypt')

async function hash_password(password){
  const salt = await bcrypt.genSalt();
  const hashed_password = await bcrypt.hash(password, salt);
  return hashed_password
}

let password = "wilsonglobal*"
hash_password(password)
.then((hashed)=>console.log(hashed))