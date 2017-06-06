/**
* Represents an error or a warning reported by the compiler.
*
* It can be easily serialized as JSON.
*/
public struct Valhalla.ReportMessage {
    /**
    * The type of this message (error, warning, etc)
    */
    string kind;

    /**
    * The actual message.
    */
    string message;

    /**
    * The location of the message
    */
    Vala.SourceReference reference;

    /**
    * Serialize the message as JSON.
    */
    public Json.Object to_json () {
        var obj = new Json.Object ();
        obj.set_string_member ("message", message);

        var begin = new Json.Object ();
        begin.set_int_member ("line", reference.begin.line);
        begin.set_int_member ("column", reference.begin.column);

        var end = new Json.Object ();
        end.set_int_member ("line", reference.end.line);
        end.set_int_member ("column", reference.end.column);

        var location = new Json.Object ();
        location.set_string_member ("file", reference.file.filename);
        location.set_object_member ("begin", begin);
        location.set_object_member ("end", end);

        obj.set_object_member ("location", location);
        return obj;
    }
}
