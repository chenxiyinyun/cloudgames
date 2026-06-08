import { createP2PService } from '../../../../src/shared/p2p/createP2PService'
import { createLogger } from './logger'

export default createP2PService({
  gameId: 'territory',
  logger: createLogger('Territory:P2P')
})
