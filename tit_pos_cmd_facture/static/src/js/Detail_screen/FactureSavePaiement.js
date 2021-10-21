odoo.define('tit_pos_cmd_facture.FactureSavePaiement', function (require) {
    'use strict';
    const { Gui } = require('point_of_sale.Gui');
    const PosComponent = require('point_of_sale.PosComponent'); 
    const Registries = require('point_of_sale.Registries');
    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');
    const { useListener } = require('web.custom_hooks');
    const { posbus } = require('point_of_sale.utils');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');

    models.load_models({
    model:  'account.journal',
    domain: function (self) { return [['type', 'in', ['bank', 'cash','avoir_type']]]; },
    fields: [],
        loaded: function(self, journals_result){
            self.journals_recuperes = journals_result;
            }
    });

    class FactureSavePaiement extends PosComponent {
        constructor() {
            super(...arguments);
            var self = this
            this.changes = {};
            const journals_recuperes = this.props.journals_recuperes 
        } 


        captureChange(event) {
                this.changes[event.target.name] = event.target.value;  
        }
        
        get_name_client(factures_non_payees){
            /*
            Cette fonstion permet de récupérer le nom du client de la facture
            @param: 
                -factures_non_payees: facture selectionnée en cours
            */
            return factures_non_payees.partner_id[1]
        }

        get_avoir_client(factures_non_payees){
            /*
            Cette fonstion permet de récupérer l'avoir du client de la facture
            @param: 
                -factures_non_payees: facture selectionnée en cours
            */
            return factures_non_payees.avoir_client.toFixed(2);
             
        }

        async enregistrer_paiement(facture_id) {
            /*
            Cette fonction permet d'enregistrer le paiement d'une facture depuis pos
            @param:
                -facture_id : la facture sélectionnée pour etre payée
            */
            var self = this;
            let processedChanges = {};
            try {
                processedChanges['montant_saisi'] = 0
                for (let [key, value] of Object.entries(this.changes)) {
                    processedChanges[key] = value;
                    if (key == 'montant_saisi'){
                        // récupération du montant saisi à payer
                        processedChanges['montant_saisi'] = value
                    }
                }
                //récupération du journal choisi
                if (processedChanges.facture_recuperes_id > 0){
                    processedChanges['facture_recuperes_id'] = parseInt(processedChanges.facture_recuperes_id) || 0
                }
                else{
                    processedChanges['facture_recuperes_id'] = 0   
                }

                if(processedChanges['facture_recuperes_id'] === 0 ){
                    var l = this;
                    l.showPopup('ErrorPopup', {
                        title:('Attention !'),
                        body:('Veuillez sélectionner le journale s.v.p. ')
                    });
                }
                else{
                    var self = this;
                    //enregistrer le paiement de la facture
                     rpc.query({
                        model: 'account.move', 
                        method: 'add_invoice_payment', 
                        args: [processedChanges['montant_saisi'], [facture_id], processedChanges['facture_recuperes_id'], self.env.pos.pos_session.id],
                            }).then(function (u) {
                                if (u == 1){
                                    
                                    rpc.query({
                                        model: 'account.move',
                                        method: 'search_read',
                                        args: [[['payment_state','in',['not_paid','partial']],['move_type','in',['out_invoice']],['state','!=','cancel'],['invoice_date_due', '<=',new Date()]], []],
                                    }).then(function (factures_non_payees){
                                        self.env.pos.factures_non_payees = factures_non_payees;
                                        self.showScreen('FacturesNonPayee');
                                        
                                        Gui.showPopup("ValidationCommandeSucces", {
                                           title : self.env._t("Le paiemet est enregistré avec succès"),
                                           confirmText: self.env._t("OK"),
                                        });
                                    });
                                }
                                else if (u == 0) {
                                    rpc.query({
                                        model: 'account.move',
                                        method: 'search_read',
                                        args: [[['payment_state','in',['not_paid','partial']],['move_type','in',['out_invoice']],['state','!=','cancel'],['invoice_date_due', '<=',new Date()]], []],
                                    }).then(function (factures_non_payees){
                                        self.env.pos.factures_non_payees = factures_non_payees;
                                        self.showPopup('ErrorPopup', {
                                            title:('Echec !'),
                                            body:('Votre paiement n\'est pas enregistré, \n Veuillez réssayer encore une fois.  ou bien vérifier l\'avoir du client')
                                        });
                                    });
                                }
                                else if (u != 1){
                                    self.showPopup('ErrorPopup', {
                                        title:('L\'avoir est insuffisant'),
                                        body:('Vous avez que  '+u+ ' comme avoir')
                                    });
                                }
                    });
                }
            } catch (error) {
                throw error;
            }      
        }  
    }
    FactureSavePaiement.template = 'FactureSavePaiement';
    Registries.Component.add(FactureSavePaiement);
    return FactureSavePaiement;
});
