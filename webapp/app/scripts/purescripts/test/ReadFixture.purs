module Test.ReadFixture where

import Prelude
import Effect (Effect)
import Data.Argonaut.Core (Json)

foreign import readFixtureImpl :: String -> Effect Json

readFixture :: String -> Effect Json
readFixture = readFixtureImpl
