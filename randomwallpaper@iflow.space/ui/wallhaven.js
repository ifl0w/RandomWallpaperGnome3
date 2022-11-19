const Adw = imports.gi.Adw;
const ExtensionUtils = imports.misc.extensionUtils;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.wallhaven';

var WallhavenSettingsGroup = GObject.registerClass({
	GTypeName: 'WallhavenSettingsGroup',
	Template: GLib.filename_to_uri(Self.path + '/ui/wallhaven.ui', null),
	InternalChildren: [
		'allow_sfw',
		'allow_sketchy',
		'allow_nsfw',
		'api_key',
		'button_color',
		'button_color_undo',
		'category_anime',
		'category_general',
		'category_people',
		'keyword',
		'resolutions',
		'row_color'
	]
}, class WallhavenSettingsGroup extends Adw.PreferencesGroup {
	constructor(id, params = {}) {
		super(params);

		const path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/wallhaven/${id}/`;
		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_SOURCES_WALLHAVEN, path);

		this._settings.bind('allow-nsfw',
			this._allow_nsfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('allow-sfw',
			this._allow_sfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('allow-sketchy',
			this._allow_sketchy,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('api-key',
			this._api_key,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-anime',
			this._category_anime,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-general',
			this._category_general,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('category-people',
			this._category_people,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('color',
			this._row_color,
			'subtitle',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('keyword',
			this._keyword,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('resolutions',
			this._resolutions,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._button_color_undo.connect('clicked', () => {
			this._row_color.subtitle = "";
		});

		const availableColors = [
			"#660000", "#990000", "#cc0000", "#cc3333", "#ea4c88",
			"#993399", "#663399", "#333399", "#0066cc", "#0099cc",
			"#66cccc", "#77cc33", "#669900", "#336600", "#666600",
			"#999900", "#cccc33", "#ffff00", "#ffcc33", "#ff9900",
			"#ff6600", "#cc6633", "#996633", "#663300", "#000000",
			"#999999", "#cccccc", "#ffffff", "#424153",
		];

		this._colorPalette = [];

		availableColors.forEach(hexColor => {
			let rgbaColor = new Gdk.RGBA();
			rgbaColor.parse(hexColor);
			this._colorPalette.push(rgbaColor);
		});

		this._button_color.connect('clicked', () => {
			// For GTK 4.10+
			// Gtk.ColorDialog();

			// https://stackoverflow.com/a/54487948
			this._colorDialog = new Gtk.ColorChooserDialog({
				title: 'Choose a Color',
				transient_for: this.get_root(),
				modal: true,
			});
			this._colorDialog.set_use_alpha(false);
			this._colorDialog.add_palette(Gtk.Orientation.HORIZONTAL, 10, this._colorPalette);

			this._colorDialog.connect('response', (dialog, response_id) => {
				if (response_id === Gtk.ResponseType.OK) {
					// result is a Gdk.RGBA which uses float
					let rgba = this._colorDialog.get_rgba();
					// convert to rgba so it's useful
					let rgbaString = rgba.to_string(); // rgb(0,0,0)
					let rgbaArray = rgbaString.replace("rgb(", "").replace(")", "").split(",")
					let hexString = `${parseInt(rgbaArray[0]).toString(16).padStart(2, "0")}${parseInt(rgbaArray[1]).toString(16).padStart(2, "0")}${parseInt(rgbaArray[2]).toString(16).padStart(2, "0")}`;
					this._row_color.subtitle = hexString;
				}
				this._colorDialog.destroy();
			});

			this._colorDialog.show();
		});
	}

	clearConfig() {
		this._settings.reset('allow-nsfw');
		this._settings.reset('allow-sfw');
		this._settings.reset('allow-sketchy');
		this._settings.reset('api-key');
		this._settings.reset('category-anime');
		this._settings.reset('category-general');
		this._settings.reset('category-people');
		this._settings.reset('color');
		this._settings.reset('keyword');
		this._settings.reset('resolutions');
	}
});
