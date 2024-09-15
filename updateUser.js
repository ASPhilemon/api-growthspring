const express = require("express")

const Router = express.Router()

Router.post("/update-user", async (req, res)=> {
  const updateDoc = req.body
  Object.assign(req.user, updateDoc)

  try{
    await req.user.save()
    res.json({msg: "Update User successful"})
  } catch(err){
    console.log(err)
    res.status(500).json({msg: "Failed to update user"})
  }
})

module.exports = Router