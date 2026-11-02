import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.post('register', 'AuthController.register')
  Route.post('login', 'AuthController.login')
  Route.post('logout', 'AuthController.logout').middleware('auth')
  Route.get('me', 'AuthController.me').middleware('auth')
  Route.post('validate-nicknames', 'AuthController.validateNicknames')
}).prefix('auth')

Route.get('/', async () => {
  return { message: 'API is running' }
});

Route.group(() => {
  Route.get('/channels', 'ChannelsController.index').middleware('auth');
  Route.post('/channels', 'ChannelsController.create').middleware('auth');
  Route.get('/channels/all', 'ChannelsController.all').middleware('auth');
  Route.delete('/channels/:id', 'ChannelsController.destroy').middleware('auth');  
  Route.post('/channels/:id/leave', 'ChannelsController.leave').middleware('auth');
  Route.get('/users', 'UsersController.index').middleware('auth');
  Route.post('/channels/:id/kick', 'ChannelsController.kick').middleware('auth');
  Route.get('/notifications', 'NotificationController.index').middleware('auth')
  Route.delete('/notifications/:id', 'NotificationController.destroy').middleware('auth')
  Route.get('/users/dnd', 'UsersController.getDnd').middleware('auth')
}).prefix('api');