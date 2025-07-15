import ejs from "ejs"
import * as Errors from "./error-util.js"

export function renderTemplate(file_path, data){
  return new Promise((resolve, reject)=>{
    ejs.renderFile(file_path, data, (err, data)=>{
      if (err) {
        throw new Errors.InternalServerError({message: "Failed to render template", cause: err})
      }
      resolve(data)
    })
  })
}