class RouteController{

  constructor(serviceManager){
    this.serviceManager = serviceManager
  }

  async getCashLocations(req, res){}

  async getCashLocation(req, res){}

  async createCashLocation(req, res){}

  async updateCashLocation(req, res){}

  async deleteCashLocation(req, res){}

  async getCashLocationTransfers(req, res){}

  async getCashLocationTransfer(req, res){}

  async createCashLocationTransfer(req, res){}

  async updateCashLocationTransfer(req, res){}
  
  async deleteCashLocationTransfer(req, res){}
}


export default RouteController