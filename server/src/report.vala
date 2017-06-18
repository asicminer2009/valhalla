/**
* Serialize compiler errors and warnings as JSON.
*/
public class Valhalla.JsonReport : Vala.Report {

    /**
    * A list of messages that have been reported.
    */
    public Gee.ArrayList<ReportMessage?> messages { get; set; default = new Gee.ArrayList<ReportMessage?> (); }

    /**
    * @{inheritsDoc}
    */
    public override void depr (Vala.SourceReference? source, string message) {
        messages.add ({ "deprecation", message, source });
    }

    /**
    * @{inheritsDoc}
    */
    public override void err (Vala.SourceReference? source, string message) {
        errors++;
        messages.add ({ "error", message, source });
    }

    /**
    * @{inheritsDoc}
    */
    public override void note (Vala.SourceReference? source, string message) {
        messages.add ({ "note", message, source });
    }

    /**
    * @{inheritsDoc}
    */
    public override void warn (Vala.SourceReference? source, string message) {
        warnings++;
        messages.add ({ "warning", message, source });
    }

    /**
    * Reset everything
    */
    public void clear () {
        messages.clear ();
        errors = 0;
        warnings = 0;
    }
}
