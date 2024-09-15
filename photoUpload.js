const multer = require('multer');
const path = require('path');
const express = require("express")
const fs = require("fs")

const Router = express.Router()

const upload = multer({ dest: 'uploads/'   
 }); // Temporary storage for uploaded files

Router.post('/upload-photo', upload.single('image'), async (req, res) => {
  const userId = req.user._id;
  const fileName = `${userId}-${new Date().toDateString()}.jpg`;
  const filePath = path.join('public', 'img', fileName);

  // Replace existing file if necessary
  fs.rename(req.file.path, filePath, async (err) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ msg: "Upload Failed" });
    }
    const user = req.user;
    user.photoURL = "img/" + req.user._id +  ".jpg"
    user.photoURL = `img/${req.user._id}-${new Date().toDateString()}.jpg`
    await user.save()
    return res.json({msg: "Upload Successful"})
  });

});

Router.delete('/delete-photo', async (req, res) => {

  const fileName = req.user.photoURL
  const filePath = path.join('public', fileName);

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') { // Ignore if file doesn't exist
      return res.status(500).send('Error deleting image');
    }
  });
  const user = req.user
  user.photoURL = ""
  await user.save()
  return res.json({msg: "Photo Update Successful"})
});

module.exports =  Router