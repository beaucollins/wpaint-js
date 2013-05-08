# Excercises

## Excercise 1

models.MediaLibrary is a collection that requests data from the XML-RPC API.

Task: Create a model named model.MediaItem to represent an instance of a single media item and hook it up to the MediaLibrary model.
Hint: [See the `model` property of Backbone.Collection](http://backbonejs.org/#Collection-model)

## Excercise 2

The ui.LibraryList view is given an instance of model.MediaLibrary as it's model. When the
LibraryList is initialized it should register to listen when new model.MediaItem instances
are added to the library and display them as a thumbnail.

Task: have the model fetch new data and when a new model is added create a new ui.LibraryThumb renders the added model.MediaItem instance.

Bonus:
 - make it so the library can load more items from the API
 - show a loading indicator for API requests
 - provide a refresh button


## Excercise 3

When a thumbnail is clicked it should be given a selected state. Only one MediaItem can be selected
at a time. The selected item should then be loaded into the canvas instance.

Task: Set up the click event for the ui.LibraryThumb and hook up all the events in index.html

Bonus: 
  - Show a loading state while the canvas downloads the full image
  - add a way to type in a file name, description, etc

## Excercise 4

Update the model.MediaItem sync method for the read operation so it can fetch it's
data from the XML-RPC API (wp.getMediaItem XML-RPC method).

## Extra Credit

- Create a way to change the color of the stroke that gets drawn.
- Create a way to erase the stroke. (See the layers feature)