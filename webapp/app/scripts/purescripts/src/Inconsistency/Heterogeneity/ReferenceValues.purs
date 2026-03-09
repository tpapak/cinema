module Heterogeneity.ReferenceValues where

import Prelude
import Effect
import Effect.Console (log, logShow)
import Data.Array
import Data.Argonaut
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
-- import Data.Argonaut.Generic -- REMOVED: Use DecodeJson instances
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.List.Types
import Data.Maybe
import Data.Either (Either(..))
import Data.Int
import Data.Newtype
import Data.String as S
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)

newtype ReferenceValueQuery = ReferenceValuesQuery
  { measurement :: Array String
  , "OutcomeType" :: Array String
  , " InterventionComparisonType" :: Array String
  }

makeQueries :: Json -> Json
makeQueries fpars = fpars
