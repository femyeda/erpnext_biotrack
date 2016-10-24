var available_products;
var ccscript = $.extend({}, cur_frm.cscript);

var ste_listeners = {
    refresh: function (frm) {
        // set doc.company and hide
        erpnext.hide_company();

        // ste.toggle_related_fields(frm);
        ste.set_warehouse_query(frm);
        ste.set_items_query(frm);

        ste_listeners.conversion(frm);

    },
    conversion: function (frm) {
        ste.toggle_related_fields(frm);

        if (frm.doc.conversion === 'Create Product') {
            if (!available_products) {
                frappe.call({
                    method: 'erpnext_biotrack.controllers.queries.available_products',
                    callback: function (r) {
                        available_products = r.message;
                        ste.set_product_query(frm);
                    }
                });
            }
        }
    },
    product_group: function (frm) {
        frappe.call({
            method: 'erpnext_biotrack.controllers.queries.lookup_product_sources',
            args: {product: frm.doc.product_group},
            callback: function (r) {
                ste.reset_items(frm);
                ste.item_filters.item_group = ['item_group', 'in', r.message];
                ste.set_items_query(frm);
            }
        });
    },

    lot_group: function (frm) {
        ste.set_items_query(frm);
        ste.reset_items(frm);
    },
    from_warehouse: function (frm) {
        ste.set_items_query(frm);
    }
};

frappe.ui.form.on("Stock Entry", ste_listeners);
cur_frm.cscript = $.extend(cur_frm.cscript, {
    items_add: function (doc, cdt, cdn) {
        ccscript.items_add.apply(ccscript, arguments);

        if (!doc.conversion) {
            return;
        }

        var doclist = doc['items'];
        var row = frappe.get_doc(cdt, cdn);
        if (doclist.length === 2 && doclist[0] !== row) {
            var strain = doclist[0]['strain'];
            ste.item_filters.strain = {strain: strain};
            // add strain into query filter to make sure next item is same strain
            ste.set_items_query(cur_frm);
        }
    },
    items_remove: function (doc) {
        if (!doc.conversion) {
            return;
        }

        // Reset item query base on first row
        if (doc['items'].length === 0) {
            ste.item_filters.strain = null;
            ste.set_items_query(cur_frm);
        }
    }

});

var ste = {
    item_filters: {
        item_group: null
    },
    toggle_related_fields: function (frm) {
        frm.toggle_reqd('from_warehouse', frm.doc.conversion);
        frm.toggle_reqd('product_group', frm.doc.conversion === 'Create Product');
        frm.toggle_reqd('product_qty', frm.doc.conversion === 'Create Product');
        frm.toggle_reqd('lot_group', frm.doc.conversion === 'Create Lot');
    },
    reset_items: function (frm) {
        if (frm.is_new()) {
            frm.doc['items'] = [];
            refresh_field("items");
        }
    },
    set_warehouse_query: function (frm) {
        var filters = frm.fields_dict.from_warehouse.get_query().filters, i, is_filtered = false;
        for (i = 0; i < filters.length; i++) {
            is_filtered = is_filtered || (filters[i][1] == "warehouse_type");
        }

        if (!is_filtered) {
            filters.push([
                "Warehouse",
                "warehouse_type",
                "=",
                "Inventory Room"
            ]);

            frm.fields_dict.from_warehouse.get_query = function () {
                return {
                    filters: filters
                }
            };

            frm.fields_dict.to_warehouse.get_query = function () {
                return {
                    filters: filters
                }
            };

            frm.fields_dict.items.grid.get_field('s_warehouse').get_query = function () {
                return {
                    filters: filters
                }
            };

            frm.fields_dict.items.grid.get_field('f_warehouse').get_query = function () {
                return {
                    filters: filters
                }
            }
        }
    },
    set_product_query: function (frm) {
        frm.fields_dict.product_group.get_query = function () {
            return {
                filters: [['item_group_name', 'in', available_products]]
            }
        }
    },

    set_items_query: function (frm) {
        var filters = [{is_stock_item: 1}];

        if (ste.item_filters.strain) {
            filters.push(ste.item_filters.strain);
        }

        if (frm.doc.conversion === 'Create Lot') {
            if (frm.doc.lot_group === 'Flower Lot') {
                filters.push({item_group: 'Flower'})
            } else if (frm.doc.lot_group === 'Other Plant Material Lot') {
                filters.push({item_group: 'Other Plant Material'});
            }
        } else if (frm.doc.conversion === 'Create Product' && ste.item_filters.item_group) {
            filters.push(ste.item_filters.item_group);
        }

        if (frm.doc.from_warehouse) {
            filters.push({default_warehouse: frm.doc.from_warehouse});
        }

        frm.fields_dict.items.grid.get_field('item_code').get_query = function () {
            return erpnext.queries.item(filters);
        };
    }
};
