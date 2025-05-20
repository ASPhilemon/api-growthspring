import * as ErrorUtil from "./error-util.js"

export async function tryMongoose(promise) {
  try {
    return await promise
  } catch (err) {
    ErrorUtil.handleMongooseError(err)
  }
}