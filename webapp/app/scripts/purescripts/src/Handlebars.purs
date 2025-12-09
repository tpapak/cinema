-- | Simple FFI wrapper for Handlebars compile function
module Handlebars where

import Prelude
import Data.Function.Uncurried (Fn2, runFn2)

-- | Compile a Handlebars template string with the given data
foreign import compileImpl :: forall a. Fn2 String a String

compile :: forall a. String -> a -> String
compile template dataObj = runFn2 compileImpl template dataObj
