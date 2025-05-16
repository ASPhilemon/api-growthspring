class RouteController{

  constructor(serviceManager){
    this.serviceManager = serviceManager
  }

  async getLoans(req, res){}

  async getLoan(req, res){}

  async createLoan(req, res){}

  async approveLoan(req, res){}

  async closeLoan(req, res){}

  async deleteLoan(req, res){}

  async getLoanPayments(req, res){}

  async getLoanPayment(req, res){}

  async createLoanPayment(req, res){}

  async updateLoanPayment(req, res){}
  
  async deleteLoanPayment(req, res){}
}


export default RouteController