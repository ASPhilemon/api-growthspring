class ServiceManager{

  constructor(Loan, LoanPayment){
    this.Loan = Loan
    this.LoanPayment = LoanPayment
  }

  async getLoans(){}

  async getLoan(){}

  async createLoan(){}

  async approveLoan(){}

  async closeLoan(){}

  async deleteLoan(){}

  async getLoanPayments(){}

  async getLoanPayment(){}

  async createLoanPayment(){}

  async updateLoanPayment(){}
  
  async deleteLoanPayment(){}

}


export default ServiceManager