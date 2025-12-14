import Application from '@ioc:Adonis/Core/Application'
import WsExceptionHandler from '@ioc:Ruby184/Socket.IO/WsExceptionHandler'

export default class ExceptionHandler extends WsExceptionHandler {
  constructor() {
    super(Application)
  }
}
