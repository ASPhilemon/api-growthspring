class ServiceManager{

  constructor(CashLocation, CashLocationTransfer){
    this.CashLocation = CashLocation
    this.CashLocationTransfer = CashLocationTransfer
  }

  async getCashLocations(){}

  async getCashLocation(){}

  async createCashLocation(){}

  async updateCashLocation(){}

  async deleteCashLocation(){}

  async getCashLocationTransfers(){}

  async getCashLocationTransfer(){}

  async createCashLocationTransfer(){}

  async updateCashLocationTransfer(){}

  async deleteCashLocationTransfer(){}
}


export default ServiceManager