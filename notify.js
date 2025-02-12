const AWS = require("aws-sdk");

const lambda = new AWS.Lambda({ region: "us-east-1" });

async function notifyLoanNew(payload) {
  try {
    const params = {
      FunctionName: "loan-new",
      Payload: JSON.stringify(payload), 
    };

    const response = await lambda.invoke(params).promise();
    console.log("Lambda Response:", JSON.parse(response.Payload));
  } catch (error) {
    console.error("Error invoking Lambda:", error);
  }
}

async function notifyLoanPayment(payload) {
  try {
    const params = {
      FunctionName: "loan-payment",
      Payload: JSON.stringify(payload), 
    };

    const response = await lambda.invoke(params).promise();
    console.log("Lambda Response:", JSON.parse(response.Payload));
  } catch (error) {
    console.error("Error invoking Lambda:", error);
  }
}


module.exports = { notifyLoanNew, notifyLoanPayment}
