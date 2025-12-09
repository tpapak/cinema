module SaveModel where

import Prelude
import Effect (Effect)
import Data.Function.Uncurried (Fn2, runFn2)

-- The SAVE_STATE effect is now just Effect  
-- The JS FFI still triggers window.Model.saveState()

foreign import saveStateImpl :: forall pos st. Fn2 pos st (Effect Unit)

saveState :: forall pos st. pos -> st -> Effect Unit
saveState pos st = runFn2 saveStateImpl pos st

