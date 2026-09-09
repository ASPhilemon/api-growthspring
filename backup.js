import fs from "fs";
import path from "path";
import os from "os";
import {ZipArchive} from "archiver";
import mongoose from "mongoose";
import {BSON} from "mongodb"
import nodeCron from "node-cron";
import * as EmailServiceManager from "./services/email-service/service.js"

const { EJSON } = BSON


async function backupDatabaseAndEmail(recipients) {
    if (!recipients){
        recipients = ["philemonariko@gmail.com", "blaisemwebe@gmail.com"]
    }

  const db = mongoose.connection.db;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "growthspring-"));
  const zipPath = path.join(tempDir, "growthspring.zip");

  try {
    const collections = await db.listCollections().toArray();
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 }});
    const archiveFinished = new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
    });

    archive.pipe(output);

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const documents = await db
        .collection(collectionName)
        .find({})
        .toArray();
      const json = EJSON.stringify(
        documents,
        null,
        2
      );
      archive.append(json, {
        name: `${collectionName}.json`,
      });
    }

    await archive.finalize();
    await archiveFinished;

    const message = `
        <p>Dear Admin Team,</p>
        <p> Please find attached the latest Growthspring database backup.</p>
        <p> The archive contains an Extended JSON file for each MongoDB collection.</p>
        <h6>Growthspring Backup System</h6>
    `

    await EmailServiceManager.sendEmail(
        "Growthspring.Backup",
        recipients,
        "Growthspring Database Backup",
        message,
        [
            {
                filename: "growthspring.zip",
                path: zipPath,
            },
        ],

    )


  } catch (err) {
    console.log("Failed to backup database: ", err)
  } finally {
    await fs.promises.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

export function schedule(){
    // Runs every Monday at 3:00 HRS(7AM) UTC => 6AM EAT
    nodeCron.schedule('0 3 * * 1', async ()=>{
        await backupDatabaseAndEmail()
        console.log("Database Backup Executed ...")
    },{timezone: 'UTC'})

}