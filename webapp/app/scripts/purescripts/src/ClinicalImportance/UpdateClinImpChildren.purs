module UpdateClinImpChildren where

import Prelude
import Effect (Effect)

-- The UPDATE_CHILDREN effect is now just Effect
-- The JS FFI still triggers Actions.Heterogeneity.updateState() etc.

foreign import updateClinImpChildren :: Effect Unit
